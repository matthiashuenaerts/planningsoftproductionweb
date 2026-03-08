
-- Hash all existing plaintext passwords using extensions schema
UPDATE public.employees
SET password = extensions.crypt(password, extensions.gen_salt('bf'))
WHERE password IS NOT NULL 
  AND password != ''
  AND password NOT LIKE '$2a$%'
  AND password NOT LIKE '$2b$%';
