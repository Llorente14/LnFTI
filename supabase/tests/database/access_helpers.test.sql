begin;
select plan(3);
select has_function('public', 'current_app_role', array[]::text[], 'current_app_role exists');
select has_function('public', 'is_verified_student', array[]::text[], 'is_verified_student exists');
select has_function('public', 'can_claim_report', array['uuid'], 'can_claim_report exists');
select * from finish();
rollback;
