import { router, useLocalSearchParams } from 'expo-router';
import { useRef, useState } from 'react';
import { ActivityIndicator, Image, Switch, Text, View } from 'react-native';
import * as Crypto from 'expo-crypto';
import * as ImagePicker from 'expo-image-picker';
import { AppScreen } from '@/components/layout/app-screen';
import { AppButton } from '@/components/ui/app-button';
import { FormField } from '@/components/ui/form-field';
import { SearchField } from '@/components/ui/search-field';
import { StatusBadge } from '@/features/orders/status-badge';
import { useOperations } from '@/state/operations';
import { signOut } from '@/state/auth';
import { colors, spacing, textStyles } from '@/theme/tokens';
import { errorText, uploadPhoto } from './api';
import { money, parsePrice, pickupTimestamp, quantity, statusLabel, transitions, type Business, type Customer, type OrderRecord, type Product, type Status } from './domain';
import { Copy, DataScreen, ErrorNotice, FormCard, PendingSave, ProductPhoto, useMutation } from './ui';

export function Dashboard() {
  const { data, loading, error, refresh } = useOperations();
  const [name, setName] = useState(''); const mutation = useMutation();
  const [logoutError,setLogoutError]=useState<string|null>(null);
  if (!data) return <AppScreen hideSettings title="Your business">
    <PendingSave />
    {loading ? <ActivityIndicator /> : error ? <ErrorNotice message={error} /> : <FormCard>
      <Copy>Owners can create a business. Staff should give their verified email to the owner, then refresh after being added.</Copy>
      <FormField label="Business name" value={name} onChangeText={setName} />
      <ErrorNotice message={mutation.error} /><AppButton label="Create my business" disabled={mutation.busy || !name.trim()} onPress={() => { void mutation.run({op:'create_business',name:name.trim()}); }} />
    </FormCard>}
    <AppButton label="Refresh membership" disabled={loading} onPress={() => {void refresh();}} variant="secondary" />
    <ErrorNotice message={logoutError} /><AppButton label="Sign out" variant="secondary" onPress={() => {void signOut().catch((e)=>setLogoutError(errorText(e)));}} />
  </AppScreen>;
  const today=data.orders.filter((order)=>order.business_date===data.today);
  return <DataScreen title={data.business.name}>
    <FormCard><Text style={textStyles.title}>Kitchen operations</Text><Copy>{data.role === 'owner' ? 'Owner' : 'Staff'} · {data.today} · Asia/Manila</Copy>
      <Copy>{today.length} orders today · {today.filter((order)=>!['completed','rejected','expired'].includes(order.status)).length} open</Copy>
      {!data.business.rules_approved ? <Copy>The owner must record order rules in Settings before confirmations are enabled.</Copy> : null}
      <AppButton label="Manage orders" onPress={()=>router.push('/(owner)/(tabs)/orders')} />
      <AppButton label="New manual order" variant="secondary" onPress={()=>router.push({pathname:'/(owner)/order/[id]',params:{id:'new'}})} />
    </FormCard>
    <FormCard><Copy>Messenger, AI, promotions, and research analytics are not connected in this release.</Copy></FormCard>
  </DataScreen>;
}

export function Menu() {
  const {data}=useOperations(); const [query,setQuery]=useState('');
  const visible=data?.products.filter((item)=>item.name.toLowerCase().includes(query.toLowerCase()))??[];
  return <DataScreen title="Menu">
    <SearchField placeholder="Search menu" value={query} onChangeText={setQuery} />
    {data?.role==='owner' ? <AppButton label="Add menu item" onPress={()=>router.push({pathname:'/(owner)/menu-item/[id]',params:{id:'new'}})} />:null}
    {visible.map((item)=>{const allocation=data?.allocations.find((a)=>a.product_id===item.id);return <FormCard key={item.id}>
      <ProductPhoto path={item.photo_path} /><Text style={textStyles.title}>{item.name} · {money(item.price_centavos)}</Text><Copy>{item.description}</Copy>
      <Copy>{item.active?'Available':'Paused'} · {allocation ? allocation.total-allocation.used : 0} remaining today</Copy>
      {data?.role==='owner'?<AppButton label="Edit item and quantity" variant="secondary" onPress={()=>router.push({pathname:'/(owner)/menu-item/[id]',params:{id:item.id}})} />:null}
    </FormCard>;})}
    {!visible.length?<Copy>No matching menu items. Add an item to begin.</Copy>:null}
  </DataScreen>;
}

export function MenuItem() {
  const {id}=useLocalSearchParams<{id:string}>(); const {data}=useOperations(); const item=data?.products.find((p)=>p.id===id);
  return <DataScreen title={id==='new'?'New menu item':'Edit menu item'} ownerOnly detail>
    {id==='new'||item?<ProductEditor key={`${id}-${item?.version}`} item={item} />:<Copy>Menu item not found.</Copy>}
  </DataScreen>;
}
function ProductEditor({item}:{item?:Product}) {
  const {data}=useOperations(); const mutation=useMutation();
  const [id]=useState(()=>item?.id??Crypto.randomUUID());
  const [name,setName]=useState(item?.name??''); const [price,setPrice]=useState(item ? (item.price_centavos/100).toFixed(2):'');
  const [description,setDescription]=useState(item?.description??''); const [active,setActive]=useState(item?.active??true);
  const [photo,setPhoto]=useState<ImagePicker.ImagePickerAsset|null>(null); const [uploading,setUploading]=useState(false); const [error,setError]=useState<string|null>(null);
  const uploaded=useRef<{uri:string;path:string}|null>(null);
  const [version,setVersion]=useState(item?.version??0);
  async function choose() {
    try { const result=await ImagePicker.launchImageLibraryAsync({mediaTypes:['images'],base64:true,quality:0.7,allowsEditing:true}); if(!result.canceled) {setPhoto(result.assets[0]);uploaded.current=null;} }
    catch(failure){setError(errorText(failure));}
  }
  async function save() {
    if(!data || uploading || mutation.busy)return;
    setError(null);setUploading(true);
    try {
      if(!name.trim())throw new Error('Enter the menu name.'); const cents=parsePrice(price);
      let path=item?.photo_path??null;
      if(photo){if(uploaded.current?.uri!==photo.uri)uploaded.current={uri:photo.uri,path:await uploadPhoto(data.business.id,id,photo)};path=uploaded.current.path;}
      await mutation.run({op:'save_product',business_id:data.business.id,id,version,name:name.trim(),description,price_centavos:cents,active,photo_path:path},()=>{
        setVersion((n)=>n+1);router.replace({pathname:'/(owner)/menu-item/[id]',params:{id}});
      });
    }catch(failure){setError(errorText(failure));}finally{setUploading(false);}
  }
  return <>
    <FormCard>{photo?<Image source={{uri:photo.uri}} style={{height:180,width:'100%',borderRadius:12}} />:<ProductPhoto path={item?.photo_path??null} />}
      <AppButton label="Choose photo" disabled={uploading||mutation.busy} variant="secondary" onPress={()=>{void choose();}} />
      <FormField label="Menu name" value={name} onChangeText={setName} /><FormField label="Price (PHP)" inputMode="decimal" value={price} onChangeText={setPrice} />
      <FormField label="Description" multiline value={description} onChangeText={setDescription} />
      <Copy>Available for new orders</Copy><Switch accessibilityLabel="Available for new orders" value={active} onValueChange={setActive} />
      <ErrorNotice message={error??mutation.error} />{mutation.success?<Copy>Menu item saved.</Copy>:null}
      <AppButton label={uploading||mutation.busy?'Saving…':'Save menu item'} disabled={uploading||mutation.busy} onPress={()=>{void save();}} />
    </FormCard>
    {item?<AllocationEditor key={`${item.id}-${data?.today}-${data?.allocations.find((a)=>a.product_id===item.id)?.version}`} productId={item.id} />:<Copy>Save the item first, then set its daily sellable quantity.</Copy>}
  </>;
}
function AllocationEditor({productId}:{productId:string}) {
  const {data}=useOperations(); const allocation=data?.allocations.find((a)=>a.product_id===productId);
  const [total,setTotal]=useState(String(allocation?.total??0)); const [reason,setReason]=useState(''); const [version,setVersion]=useState(allocation?.version??0);
  const [error,setError]=useState<string|null>(null);const mutation=useMutation();
  return <FormCard><Text style={textStyles.title}>Daily sellable quantity</Text><Copy>{data?.today} · {allocation?.used??0} already allocated. Historical days are preserved.</Copy>
    <FormField label="Total quantity for today" inputMode="numeric" value={total} onChangeText={setTotal} /><FormField label="Adjustment reason" value={reason} onChangeText={setReason} />
    <ErrorNotice message={error??mutation.error} />{mutation.success?<Copy>Daily quantity saved.</Copy>:null}
    <AppButton label="Save daily quantity" disabled={mutation.busy} onPress={()=>{try {setError(null);const count=quantity(total);if(!reason.trim())throw new Error('Enter an adjustment reason.');void mutation.run({op:'set_allocation',business_id:data!.business.id,id:productId,business_date:data!.today,version,total:count,reason},()=>setVersion((n)=>n+1));}catch(failure){setError(errorText(failure));}}} />
  </FormCard>;
}

export function Customers() {
  const {data}=useOperations();const [query,setQuery]=useState('');const [archived,setArchived]=useState(false);
  const visible=data?.customers.filter((c)=>(archived||!c.archived)&&c.name.toLowerCase().includes(query.toLowerCase()))??[];
  return <DataScreen title="Customers"><SearchField placeholder="Search customers" value={query} onChangeText={setQuery} />
    <AppButton label="Add customer" onPress={()=>router.push({pathname:'/(owner)/customer/[id]',params:{id:'new'}})} />
    <Copy>Include archived customers</Copy><Switch accessibilityLabel="Include archived customers" value={archived} onValueChange={setArchived} />
    {visible.map((customer)=><FormCard key={customer.id}><Text style={textStyles.title}>{customer.name}{customer.archived?' (archived)':''}</Text><Copy>{customer.phone||'No phone recorded'}</Copy>
      <AppButton label="Open customer" variant="secondary" onPress={()=>router.push({pathname:'/(owner)/customer/[id]',params:{id:customer.id}})} />
    </FormCard>)}{!visible.length?<Copy>No matching customers.</Copy>:null}
  </DataScreen>;
}
export function CustomerDetail() {
  const {id}=useLocalSearchParams<{id:string}>();const {data}=useOperations();const customer=data?.customers.find((c)=>c.id===id);
  return <DataScreen title={id==='new'?'New customer':'Customer record'} detail>{id==='new'||customer?<CustomerEditor key={`${id}-${customer?.version}`} customer={customer} />:<Copy>Customer not found.</Copy>}</DataScreen>;
}
function CustomerEditor({customer}:{customer?:Customer}) {
  const {data}=useOperations();const mutation=useMutation();const [id]=useState(()=>customer?.id??Crypto.randomUUID());const [version,setVersion]=useState(customer?.version??0);
  const [name,setName]=useState(customer?.name??'');const [phone,setPhone]=useState(customer?.phone??'');const [notes,setNotes]=useState(customer?.notes??'');const [archived,setArchived]=useState(customer?.archived??false);
  const history=data?.orders.filter((o)=>o.customer_id===id)??[];
  return <><FormCard><FormField label="Customer name" value={name} onChangeText={setName} /><FormField label="Contact phone" inputMode="tel" value={phone} onChangeText={setPhone} /><FormField label="Order-related notes" multiline value={notes} onChangeText={setNotes} />
    {customer?<><Copy>Archive customer (purchase history is retained)</Copy><Switch accessibilityLabel="Archive customer" value={archived} onValueChange={setArchived} /></>:null}
    <ErrorNotice message={mutation.error} />{mutation.success?<Copy>Customer saved.</Copy>:null}<AppButton label="Save customer" disabled={mutation.busy||!name.trim()} onPress={()=>{void mutation.run({op:'save_customer',business_id:data!.business.id,id,version,name:name.trim(),phone,notes,archived},()=>{setVersion((n)=>n+1);router.replace({pathname:'/(owner)/customer/[id]',params:{id}});});}} />
  </FormCard><Text style={textStyles.title}>Purchase history</Text><Copy>{history.filter((o)=>o.status==='completed').length} completed orders</Copy>
    {history.map((order)=><OrderSummary key={order.id} order={order} />)}{!history.length?<Copy>No orders yet.</Copy>:null}</>;
}

function OrderSummary({order}:{order:OrderRecord}) {
  const {data}=useOperations();
  return <FormCard><Text style={textStyles.title}>{data?.customers.find((c)=>c.id===order.customer_id)?.name??'Customer'}</Text><Copy>#{order.id.slice(0,8)} · {statusLabel[order.status]}</Copy>
    <Copy>{money(order.total_centavos)} · {new Date(order.pickup_at).toLocaleString('en-PH',{timeZone:'Asia/Manila'})}</Copy>
    <AppButton label="Open order" variant="secondary" onPress={()=>router.push({pathname:'/(owner)/order/[id]',params:{id:order.id}})} />
  </FormCard>;
}
export function Orders() {
  const {data}=useOperations();const [filter,setFilter]=useState<Status|'all'>('all');
  const visible=data?.orders.filter((o)=>filter==='all'||o.status===filter)??[];
  return <DataScreen title="Orders"><AppButton label="New manual order" onPress={()=>router.push({pathname:'/(owner)/order/[id]',params:{id:'new'}})} />
    <View style={{flexDirection:'row',flexWrap:'wrap',gap:spacing.sm}}>{(['all',...Object.keys(statusLabel)] as (Status|'all')[]).map((status)=><AppButton key={status} compact variant={filter===status?'primary':'secondary'} label={status==='all'?'All':statusLabel[status]} onPress={()=>setFilter(status)} />)}</View>
    {visible.map((order)=><OrderSummary key={order.id} order={order} />)}{!visible.length?<Copy>No orders for this status.</Copy>:null}
  </DataScreen>;
}
export function OrderDetail() {
  const {id}=useLocalSearchParams<{id:string}>();const {data}=useOperations();const order=data?.orders.find((o)=>o.id===id);
  return <DataScreen title={id==='new'?'New Manual Order':'Order Details'} detail>{id==='new'?<NewOrder />:order?<ExistingOrder key={`${order.id}-${order.version}`} order={order} />:<Copy>Order not found.</Copy>}</DataScreen>;
}
function NewOrder() {
  const {data}=useOperations();const mutation=useMutation();const [id]=useState(()=>Crypto.randomUUID());
  const [customerId,setCustomerId]=useState('');const [quantities,setQuantities]=useState<Record<string,string>>({});
  const [time,setTime]=useState('');const [payment,setPayment]=useState('Cash on pickup');const [notes,setNotes]=useState('');const [error,setError]=useState<string|null>(null);
  const products=data?.products.filter((p)=>p.active)??[];
  async function save(){try {setError(null);if(!customerId)throw new Error('Select a customer.');const items=products.map((p)=>({product_id:p.id,quantity:quantity(quantities[p.id]||'0')})).filter((i)=>i.quantity>0);if(!items.length)throw new Error('Select at least one item.');await mutation.run({op:'create_order',business_id:data!.business.id,id,customer_id:customerId,pickup_at:pickupTimestamp(data!.today,time),payment_method:payment,notes,items},()=>router.replace({pathname:'/(owner)/order/[id]',params:{id}}));}catch(failure){setError(errorText(failure));}}
  return <><FormCard><Text style={textStyles.title}>Customer</Text>{data?.customers.filter((c)=>!c.archived).map((c)=><AppButton key={c.id} label={c.name} variant={customerId===c.id?'primary':'secondary'} onPress={()=>setCustomerId(c.id)} />)}
    <AppButton label="Add a customer" variant="secondary" onPress={()=>router.push({pathname:'/(owner)/customer/[id]',params:{id:'new'}})} />
  </FormCard><FormCard><Text style={textStyles.title}>Items</Text>{products.map((p)=><FormField key={p.id} label={`${p.name} · ${money(p.price_centavos)} · quantity`} inputMode="numeric" value={quantities[p.id]??''} onChangeText={(value)=>setQuantities((current)=>({...current,[p.id]:value}))} />)}{!products.length?<Copy>The owner must add available menu items first.</Copy>:null}</FormCard>
    <FormCard><Copy>Same-day pickup · {data?.today} · Asia/Manila</Copy><FormField label="Pickup time (HH:MM, 24-hour)" value={time} onChangeText={setTime} /><FormField label="Payment method (not verification)" value={payment} onChangeText={setPayment} /><FormField label="Special request" multiline value={notes} onChangeText={setNotes} />
      <Copy>Saving creates a confirmed order. Staff acceptance on the next screen checks availability and reserves daily quantity.</Copy><ErrorNotice message={error??mutation.error} /><AppButton label="Save confirmed order" disabled={mutation.busy} onPress={()=>{void save();}} />
    </FormCard></>;
}
function ExistingOrder({order}:{order:OrderRecord}) {
  const {data}=useOperations();const mutation=useMutation();const edit=useMutation();const [reason,setReason]=useState('');
  const [time,setTime]=useState(new Date(order.pickup_at).toLocaleTimeString('en-GB',{timeZone:'Asia/Manila',hour:'2-digit',minute:'2-digit'}));const [payment,setPayment]=useState(order.payment_method);const [notes,setNotes]=useState(order.notes);const [error,setError]=useState<string|null>(null);
  const items=data?.items.filter((i)=>i.order_id===order.id)??[];
  return <><FormCard><View style={{alignItems:'flex-start',flexDirection:'row',gap:spacing.md,justifyContent:'space-between'}}><View style={{flex:1}}><Text style={{...textStyles.label,color:colors.terracotta}}>#{order.id.slice(0,8).toUpperCase()}</Text><Text style={[textStyles.title,{fontSize:20,marginTop:6}]}>{data?.customers.find((c)=>c.id===order.customer_id)?.name}</Text><Copy>Pickup · {order.business_date}</Copy></View><StatusBadge status={order.status} label={statusLabel[order.status]} /></View>
    {items.map((item)=><Copy key={item.id}>{item.quantity} × {item.name} · {money(item.price_centavos)} each</Copy>)}<Text style={textStyles.title}>Total {money(order.total_centavos)}</Text>
    <Copy>Pickup: {new Date(order.pickup_at).toLocaleString('en-PH',{timeZone:'Asia/Manila'})}</Copy><Copy>Payment method: {order.payment_method} (not verified)</Copy><Copy>{order.notes||'No special request'}</Copy>
  </FormCard>
    {order.status==='confirmed'?<FormCard><FormField label="Pickup time (HH:MM)" value={time} onChangeText={setTime} /><FormField label="Payment method" value={payment} onChangeText={setPayment} /><FormField label="Special request" multiline value={notes} onChangeText={setNotes} /><ErrorNotice message={error??edit.error} />
      <AppButton label="Save confirmed details" disabled={edit.busy||mutation.busy} onPress={()=>{try{setError(null);void edit.run({op:'update_order',business_id:order.business_id,id:order.id,version:order.version,pickup_at:pickupTimestamp(order.business_date,time),payment_method:payment,notes});}catch(failure){setError(errorText(failure));}}} />
    </FormCard>:null}
    {transitions[order.status].filter((status)=>status!=='expired').length?<FormCard>{transitions[order.status].includes('rejected')?<FormField label="Reason (required for rejection)" value={reason} onChangeText={setReason} />:null}<ErrorNotice message={mutation.error} />
      {transitions[order.status].filter((status)=>status!=='expired').map((status)=><AppButton key={status} disabled={mutation.busy||edit.busy||(status==='accepted'&&!data?.business.rules_approved)||(status==='rejected'&&!reason.trim())} label={status==='accepted'?'Accept':status==='completed'?'Received':statusLabel[status]} variant={status==='rejected'?'danger':'primary'} onPress={()=>{void mutation.run({op:'transition_order',business_id:order.business_id,id:order.id,version:order.version,status,reason});}} />)}
      <Copy>{order.status==='confirmed'?'Acceptance checks availability and reserves quantity.':order.status==='accepted'?'A cancellation is recorded as Rejected and restores quantity under the saved policy.':'An unclaimed order remains Ready and is not counted as collected or completed.'}</Copy>
    </FormCard>:<Copy>This order has reached a final status.</Copy>}
    {data?.role==='owner'?<FormCard><Text style={textStyles.title}>Order history</Text>{data.events.filter((e)=>e.record_id===order.id).map((event)=><Copy key={event.id}>{new Date(event.created_at).toLocaleString()} · {event.action}{event.detail.from?` · ${event.detail.from} → ${event.detail.to}`:''}{event.detail.reason?` · ${event.detail.reason}`:''}</Copy>)}</FormCard>:null}
  </>;
}

export function Settings() {
  const {data,loading,error:loadError,refresh,notice}=useOperations();const [error,setError]=useState<string|null>(null);
  return <AppScreen detail hideSettings title="Settings">
    {loading?<ActivityIndicator accessibilityLabel="Loading business settings" />:null}<ErrorNotice message={loadError} />
    {notice?<Copy>{notice}</Copy>:null}{loadError?<AppButton label="Retry" variant="secondary" disabled={loading} onPress={()=>{void refresh();}} />:null}
    <PendingSave />
    {data?.role==='owner'?<SettingsEditor key={`${data.business.id}-${data.business.version}`} business={data.business} />:data?<Copy>Business settings are managed by the owner.</Copy>:!loading?<AppButton label="Open business setup" onPress={()=>router.replace('/(owner)/(tabs)/dashboard')} />:null}
    <Text style={textStyles.title}>Integrations</Text><FormCard><Copy>Meta and AI integrations are unavailable in this phase.</Copy></FormCard>
    <AppButton label="Change password" variant="secondary" onPress={()=>router.push('/(auth)/recovery')} />
    <ErrorNotice message={error} /><AppButton label="Sign out" variant="danger" onPress={()=>{void signOut().catch((failure)=>setError(errorText(failure)));}} />
  </AppScreen>;
}
function SettingsEditor({business}:{business:Business}) {
  const {data}=useOperations();
  const mutation=useMutation();const team=useMutation();const [version,setVersion]=useState(business.version);
  const [name,setName]=useState(business.name);const [address,setAddress]=useState(business.address);const [opening,setOpening]=useState(business.opening_time.slice(0,5));const [cutoff,setCutoff]=useState(business.cutoff_time.slice(0,5));
  const [approved,setApproved]=useState(business.rules_approved);const [restore,setRestore]=useState(business.rules_approved?business.restore_before_preparing:true);const [format,setFormat]=useState(business.default_post_format);
  const [email,setEmail]=useState('');const [removeId,setRemoveId]=useState('');
  return <><Text style={textStyles.title}>General</Text><FormCard><FormField label="Business name" value={name} onChangeText={setName} /><FormField label="Business address" value={address} onChangeText={setAddress} /></FormCard>
    <Text style={textStyles.title}>Order Handling</Text><FormCard>
    <FormField label="Opening time (HH:MM)" value={opening} onChangeText={(value)=>{setOpening(value);setApproved(false);}} /><FormField label="Pickup cutoff (HH:MM)" value={cutoff} onChangeText={(value)=>{setCutoff(value);setApproved(false);}} />
    <Copy>Orders use same-day pickup in Asia/Manila. Staff acceptance checks the cutoff and reserves quantity. Unclaimed orders remain Ready and are not counted as completed.</Copy>
    <Copy>Restore quantity when an accepted order is rejected</Copy><Switch accessibilityLabel="Restore quantity when an accepted order is rejected" value={restore} onValueChange={(value)=>{setRestore(value);setApproved(false);}} />
    <Copy>I confirm these business rules and operating hours.</Copy><Switch accessibilityLabel="Approve business order rules" value={approved} onValueChange={setApproved} />
    </FormCard><Text style={textStyles.title}>AI Assistant</Text><FormCard>
    <Copy>Default post format (saved preference; publishing is unavailable)</Copy>{['Text only','Photo and text'].map((value)=><AppButton key={value} label={value} variant={value===format?'primary':'secondary'} onPress={()=>setFormat(value)} />)}
    <ErrorNotice message={mutation.error} />{mutation.success?<Copy>Business settings saved.</Copy>:null}
    <AppButton label="Save business settings" disabled={mutation.busy} onPress={()=>{void mutation.run({op:'save_business',business_id:business.id,version,name,address,opening_time:opening,cutoff_time:cutoff,rules_approved:approved,restore_before_preparing:restore,default_post_format:format},()=>setVersion((n)=>n+1));}} />
  </FormCard><Text style={textStyles.title}>Staff & Permissions</Text><FormCard><Text style={textStyles.title}>Staff access</Text><Copy>Staff register and verify their email first. They can manage orders and customer details, but cannot edit menu, settings, or owner reports.</Copy>
    <FormField label="Verified staff email" autoCapitalize="none" inputMode="email" value={email} onChangeText={setEmail} /><AppButton label="Add staff" disabled={team.busy||!email.trim()} onPress={()=>{void team.run({op:'add_staff',business_id:business.id,email:email.trim()});}} />
    {data?.members.filter((member)=>member.role==='staff').map((member)=><View key={member.user_id} style={{gap:spacing.sm}}><Copy>{member.display_name}</Copy><AppButton label={removeId===member.user_id?'Confirm removal':'Remove access'} variant="danger" disabled={team.busy} onPress={()=>{if(removeId!==member.user_id)setRemoveId(member.user_id);else void team.run({op:'remove_staff',business_id:business.id,id:member.user_id},()=>setRemoveId(''));}} /></View>)}
    <ErrorNotice message={team.error} />{team.success?<Copy>Staff access updated.</Copy>:null}
  </FormCard></>;
}

export function Activity() {
  const {data}=useOperations();return <DataScreen title="Activity" ownerOnly>{data?.events.map((event)=><FormCard key={event.id}><Text style={textStyles.label}>{event.action}</Text><Copy>{new Date(event.created_at).toLocaleString()}</Copy><Copy>Record: {event.record_id}</Copy><Copy>Actor: {event.actor_id}</Copy><Copy>{JSON.stringify(event.detail)}</Copy></FormCard>)}{!data?.events.length?<Copy>No activity yet.</Copy>:null}<Copy>Showing up to 100 recent events.</Copy></DataScreen>;
}
export function Unavailable({title='Promotions'}:{title?:string}) {return <DataScreen title={title} ownerOnly><FormCard><Text style={[textStyles.title,{color:colors.terracotta}]}>Not available yet</Text><Copy>This feature is planned for a later phase. No messages or posts are being sent and no sample results are shown.</Copy></FormCard></DataScreen>;}
