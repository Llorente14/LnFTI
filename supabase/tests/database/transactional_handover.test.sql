begin;

select plan(1);

select has_function(
  'public',
  'complete_handover',
  array['uuid', 'text', 'text'],
  'complete_handover RPC exists'
);

select * from finish();
rollback;
