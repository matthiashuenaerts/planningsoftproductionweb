-- Add support for targeted messaging in project_messages
ALTER TABLE project_messages 
ADD COLUMN target_user_ids uuid[] DEFAULT NULL,
ADD COLUMN reply_to_message_id uuid DEFAULT NULL REFERENCES project_messages(id);

-- Create index for better performance on targeted messages
CREATE INDEX idx_project_messages_target_users ON project_messages USING GIN(target_user_ids);
CREATE INDEX idx_project_messages_reply_to ON project_messages(reply_to_message_id);

-- Add comment for clarity
COMMENT ON COLUMN project_messages.target_user_ids IS 'Array of employee IDs who should receive this message. NULL means everyone can see it.';
COMMENT ON COLUMN project_messages.reply_to_message_id IS 'ID of the message this is replying to, if any.';