-- The Completed notice invites the customer to follow the Page for new menu updates.
create or replace function private.messenger_order_event() returns trigger language plpgsql security definer set search_path='' as $$
declare c public.messenger_conversations; body text; items text;
begin
 if new.status=old.status then return new; end if;
 select cc.* into c from public.messenger_conversations cc join public.messenger_summaries ms on ms.conversation_id=cc.id where ms.order_id=new.id and cc.business_id=new.business_id;
 if not found then return new; end if;
 items:=coalesce(' ('||(select string_agg(oi.quantity||' × '||oi.name,', ' order by oi.name) from public.order_items oi where oi.order_id=new.id)||')','');
 body:=case when c.reply_language='taglish' then case new.status
 when 'accepted' then 'In-accept na po ang order niyo'||items||'. Sasabihan namin kayo pag ready na for pickup.'
 when 'ready' then 'Ready na po for pickup ang order niyo'||items||'.'
 when 'completed' then 'Salamat po sa pag-pickup ng order niyo'||items||'! I-follow niyo po ang Page namin para sa mga bagong menu.'
 when 'rejected' then 'Pasensya na po, hindi po namin ma-accommodate ang order niyo'||items||case new.rejection_reason
  when 'Sold out' then ' dahil sold out na po ngayon.'
  when 'Can''t prepare by pickup time' then ' dahil hindi po namin ito maihahanda bago ang pickup time niyo.'
  when 'Closing early' then ' dahil maaga po kaming magsasara ngayon.'
  else coalesce(': '||nullif(new.rejection_reason,''),'.') end
 when 'expired' then 'Expired na po ang order niyo. Message lang po kayo kung gusto niyo pa ring umorder.' end
 else case new.status
 when 'accepted' then 'Your order'||items||' has been accepted. We will let you know when it is ready for pickup.'
 when 'ready' then 'Your order'||items||' is ready for pickup.'
 when 'completed' then 'Thank you for picking up your order'||items||'! Follow our Page for new menu updates.'
 when 'rejected' then 'Sorry, we can''t accommodate your order'||items||case new.rejection_reason
  when 'Sold out' then ' because it''s sold out today.'
  when 'Can''t prepare by pickup time' then ' because we can''t prepare it by your pickup time.'
  when 'Closing early' then ' because we''re closing early today.'
  else coalesce(': '||nullif(new.rejection_reason,''),'.') end
 when 'expired' then 'Your order has expired. Message us if you would still like to order.' end end;
 if body is not null then perform private.messenger_enqueue(c.id,body,'status',new.id,new.version); end if;
 return new;
end $$;
