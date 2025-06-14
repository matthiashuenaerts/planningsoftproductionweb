import React, { useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { rushOrderService } from '@/services/rushOrderService';
import { RushOrder, EditRushOrderPayload } from '@/types/rushOrder';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { CalendarIcon, FileUp, File as FileIcon } from 'lucide-react';
import { Calendar } from '@/components/ui/calendar';
import { format } from 'date-fns';
import { cn } from '@/lib/utils';
import { useToast } from '@/hooks/use-toast';

interface EditRushOrderFormProps {
  rushOrder: RushOrder;
  onSuccess: () => void;
}

const formSchema = z.object({
  title: z.string().min(1, 'Title is required'),
  description: z.string().min(1, 'Description is required'),
  deadline: z.date({ required_error: 'Deadline is required' }),
  attachment: z.instanceof(File).optional(),
});

const EditRushOrderForm: React.FC<EditRushOrderFormProps> = ({ rushOrder, onSuccess }) => {
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const [attachmentPreview, setAttachmentPreview] = useState<string | null>(null);

  const form = useForm<EditRushOrderPayload>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      title: rushOrder.title,
      description: rushOrder.description,
      deadline: new Date(rushOrder.deadline),
      attachment: undefined,
    },
  });

  const updateMutation = useMutation({
    mutationFn: (data: {
      id: string;
      formData: EditRushOrderPayload;
      originalImageUrl?: string | null;
    }) => rushOrderService.updateRushOrder(data.id, data.formData, data.originalImageUrl),
    onSuccess: () => {
      toast({ title: 'Success', description: 'Rush order updated successfully.' });
      queryClient.invalidateQueries({ queryKey: ['rushOrders'] });
      queryClient.invalidateQueries({ queryKey: ['rushOrder', rushOrder.id] });
      onSuccess();
    },
  });

  const onSubmit = (data: EditRushOrderPayload) => {
    updateMutation.mutate({
      id: rushOrder.id,
      formData: data,
      originalImageUrl: rushOrder.image_url,
    });
  };

  const isImage = (fileName: string) => /\.(jpg|jpeg|png|gif|svg|webp)$/i.test(fileName);
  
  const handleFileChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file) {
      form.setValue('attachment', file);
      setAttachmentPreview(URL.createObjectURL(file));
    }
  };

  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
        <FormField
          control={form.control}
          name="title"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Title</FormLabel>
              <FormControl>
                <Input placeholder="e.g., Urgent part needed for Project X" {...field} />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />
        <FormField
          control={form.control}
          name="description"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Description</FormLabel>
              <FormControl>
                <Textarea placeholder="Detailed description of the issue..." {...field} rows={5}/>
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />
        <FormField
          control={form.control}
          name="deadline"
          render={({ field }) => (
            <FormItem className="flex flex-col">
              <FormLabel>Deadline</FormLabel>
              <Popover>
                <PopoverTrigger asChild>
                  <FormControl>
                    <Button
                      variant="outline"
                      className={cn(
                        'w-[240px] pl-3 text-left font-normal',
                        !field.value && 'text-muted-foreground'
                      )}
                    >
                      {field.value ? format(field.value, 'PPP') : <span>Pick a date</span>}
                      <CalendarIcon className="ml-auto h-4 w-4 opacity-50" />
                    </Button>
                  </FormControl>
                </PopoverTrigger>
                <PopoverContent className="w-auto p-0" align="start">
                  <Calendar
                    mode="single"
                    selected={field.value}
                    onSelect={field.onChange}
                    disabled={(date) => date < new Date(new Date().setHours(0,0,0,0))}
                    initialFocus
                  />
                </PopoverContent>
              </Popover>
              <FormMessage />
            </FormItem>
          )}
        />
        <FormItem>
          <FormLabel>Attachment (optional)</FormLabel>
          <FormControl>
            <div>
              <Input
                id="attachment-upload-edit"
                type="file"
                className="hidden"
                onChange={handleFileChange}
              />
              <label
                htmlFor="attachment-upload-edit"
                className="cursor-pointer inline-flex items-center justify-center rounded-md text-sm font-medium ring-offset-background transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 border border-input bg-background hover:bg-accent hover:text-accent-foreground h-10 px-4 py-2"
              >
                <FileUp className="mr-2 h-4 w-4" />
                {form.watch('attachment')?.name || 'Change attachment'}
              </label>
            </div>
          </FormControl>
          <div className="mt-4">
            <p className="text-sm font-medium text-gray-500 mb-2">Attachment Preview:</p>
            {attachmentPreview ? (
              isImage(form.watch('attachment')?.name ?? '') ? (
                <img src={attachmentPreview} alt="preview" className="h-40 w-auto rounded-md object-cover" />
              ) : (
                <div className="flex items-center gap-2 text-sm text-gray-500"><FileIcon className="h-4 w-4" /> {form.watch('attachment')?.name}</div>
              )
            ) : rushOrder.image_url ? (
              isImage(rushOrder.image_url) ? (
                <img src={rushOrder.image_url} alt="current attachment" className="h-40 w-auto rounded-md object-cover" />
              ) : (
                <a href={rushOrder.image_url} target="_blank" rel="noopener noreferrer" className="flex items-center gap-2 text-sm text-blue-600 hover:underline">
                  <FileIcon className="h-4 w-4" /> {decodeURIComponent(rushOrder.image_url.split('/').pop() ?? 'Document')}
                </a>
              )
            ) : (
              <p className="text-sm text-gray-500">No attachment uploaded.</p>
            )}
          </div>
          <FormMessage />
        </FormItem>
        
        <div className="flex justify-end">
          <Button type="submit" disabled={updateMutation.isPending}>
            {updateMutation.isPending ? 'Saving...' : 'Save Changes'}
          </Button>
        </div>
      </form>
    </Form>
  );
};

export default EditRushOrderForm;
