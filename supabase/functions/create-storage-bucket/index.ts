
import { serve } from "https://deno.land/std@0.177.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.15.0";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }
  
  // Authenticate the caller
  const authHeader = req.headers.get('Authorization');
  if (!authHeader) {
    return new Response(JSON.stringify({ error: 'Unauthorized' }), { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
  }
  const supabaseUrl = Deno.env.get("SUPABASE_URL") ?? "";
  const anonKey = Deno.env.get("SUPABASE_ANON_KEY") ?? "";
  const authClient = createClient(supabaseUrl, anonKey, { global: { headers: { Authorization: authHeader } } });
  const { data: { user }, error: authError } = await authClient.auth.getUser();
  if (authError || !user) {
    return new Response(JSON.stringify({ error: 'Invalid token' }), { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
  }
  
  const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";
  
  // Create Supabase client with service role key for admin privileges
  const supabase = createClient(supabaseUrl, supabaseServiceKey);
  
  try {
    // Check if the buckets exist first
    const { data: buckets, error: listError } = await supabase
      .storage
      .listBuckets();
      
    if (listError) {
      throw listError;
    }
    
    // Define the buckets we need to ensure
    const requiredBuckets = ['project_files', 'attachments'];
    const results = [];
    
    // Check each required bucket
    for (const bucketName of requiredBuckets) {
      const bucketExists = buckets.some(bucket => bucket.name === bucketName);
      
      if (!bucketExists) {
        // Create the bucket
        const { error } = await supabase
          .storage
          .createBucket(bucketName, {
            public: true, // Make bucket public
            fileSizeLimit: 52428800, // 50MB
          });
          
        if (error) {
          console.error(`Error creating bucket ${bucketName}:`, error);
          results.push({ bucket: bucketName, status: 'error', message: error.message });
          continue;
        }
        
        console.log(`Created storage bucket '${bucketName}'`);
        results.push({ bucket: bucketName, status: 'created' });
      } else {
        results.push({ bucket: bucketName, status: 'exists' });
      }
      
      // Set up public access policies for this bucket to bypass RLS issues
      await setupBucketPolicies(supabase, bucketName);
    }
    
    // Return success message
    return new Response(
      JSON.stringify({ 
        message: "Storage buckets have been configured", 
        results 
      }),
      {
        headers: {
          ...corsHeaders,
          'Content-Type': 'application/json',
        },
        status: 200,
      }
    );
  } catch (error: any) {
    console.error("Error in bucket creation:", error);
    
    return new Response(
      JSON.stringify({ error: error.message }),
      {
        headers: {
          ...corsHeaders,
          'Content-Type': 'application/json',
        },
        status: 500,
      }
    );
  }
});

// Function to set up comprehensive storage policies for a bucket
async function setupBucketPolicies(supabase: any, bucketName: string) {
  try {
    // Create policy for SELECT access (view files)
    const { error: selectError } = await supabase.rpc('create_storage_policy', {
      bucket_name: bucketName,
      policy_name: `${bucketName}_select_policy`,
      definition: `bucket_id = '${bucketName}'`,
      operation: 'SELECT'
    });
    
    if (selectError) {
      console.error(`Error creating SELECT policy for ${bucketName}:`, selectError);
    } else {
      console.log(`SELECT policy for ${bucketName} created successfully`);
    }
    
    // Create policy for INSERT access (upload files)
    const { error: insertError } = await supabase.rpc('create_storage_policy', {
      bucket_name: bucketName,
      policy_name: `${bucketName}_insert_policy`,
      definition: `bucket_id = '${bucketName}'`,
      operation: 'INSERT'
    });
    
    if (insertError) {
      console.error(`Error creating INSERT policy for ${bucketName}:`, insertError);
    } else {
      console.log(`INSERT policy for ${bucketName} created successfully`);
    }
    
    // Create policy for UPDATE access (modify files)
    const { error: updateError } = await supabase.rpc('create_storage_policy', {
      bucket_name: bucketName,
      policy_name: `${bucketName}_update_policy`,
      definition: `bucket_id = '${bucketName}'`,
      operation: 'UPDATE'
    });
    
    if (updateError) {
      console.error(`Error creating UPDATE policy for ${bucketName}:`, updateError);
    } else {
      console.log(`UPDATE policy for ${bucketName} created successfully`);
    }
    
    // Create policy for DELETE access (remove files)
    const { error: deleteError } = await supabase.rpc('create_storage_policy', {
      bucket_name: bucketName,
      policy_name: `${bucketName}_delete_policy`,
      definition: `bucket_id = '${bucketName}'`,
      operation: 'DELETE'
    });
    
    if (deleteError) {
      console.error(`Error creating DELETE policy for ${bucketName}:`, deleteError);
    } else {
      console.log(`DELETE policy for ${bucketName} created successfully`);
    }
  } catch (error) {
    console.error(`Error setting up policies for ${bucketName}:`, error);
  }
}
