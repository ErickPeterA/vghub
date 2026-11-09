update public.pam
   set pdf_data = null,
       pdf_filename = null,
       pdf_generated_at = null
 where pdf_data is not null
    or pdf_filename is not null
    or pdf_generated_at is not null;
