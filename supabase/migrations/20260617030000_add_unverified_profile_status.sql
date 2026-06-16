alter type public.profile_verification_status
add value if not exists 'UNVERIFIED';

alter type public.profile_verification_status
add value if not exists 'VERIFIED';
