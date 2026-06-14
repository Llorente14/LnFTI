begin;

select plan(1);

select is(
  public.is_public_report_image_object('bad/path.webp'),
  false,
  'public image helper rejects malformed path'
);

select * from finish();
rollback;
