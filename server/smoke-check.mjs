import assert from 'node:assert/strict';
import pg from 'pg';

const base='http://127.0.0.1:4002/api';let cookie='';let supplierId='',productId='',purchaseId='',saleId='',checks=0;
const db=new pg.Client({connectionString:'postgresql://postgres:postgres@127.0.0.1:55433/postgres'});await db.connect();
async function request(path,{method='GET',body}={}){const r=await fetch(base+path,{method,headers:{...(cookie?{cookie}:{}),...(body?{'content-type':'application/json'}:{})},...(body?{body:JSON.stringify(body)}:{})});const sc=r.headers.get('set-cookie');if(sc)cookie=sc.split(';')[0];return{response:r,result:r.status===204?null:await r.json()}}
function ok(test,label){assert.ok(test,label);checks++;console.log(`✓ ${label}`)}
async function signIn(email='owner@stockpilot.local'){const x=await request('/auth/login',{method:'POST',body:{email,password:'StockPilot!2026'}});assert.equal(x.response.status,200);return x.result.user}
try{
  ok((await fetch(base+'/health')).ok,'API health');
  const owner=await signIn();ok(owner.role==='owner','owner sign-in and secure cookie session');
  ok((await request('/auth/me')).result.user.workspaceName==='Northstar Retail Co.','session profile');
  ok((await request('/dashboard')).response.ok,'dashboard aggregates');
  const seedProducts=(await request('/products')).result;ok(seedProducts.length>=8,'seed catalog products');
  const seedSuppliers=(await request('/suppliers')).result;ok(seedSuppliers.length>=3,'seed suppliers');

  const esAbort=new AbortController();const stream=await fetch(base+'/events',{headers:{cookie},signal:esAbort.signal});
  ok(stream.ok&&stream.headers.get('content-type')?.includes('text/event-stream'),'authenticated live event stream');
  const reader=stream.body.getReader();await reader.read();
  let result=await request('/suppliers',{method:'POST',body:{name:`QA Vendor ${Date.now()}`,company:'QA Trading',email:'qa.vendor@example.test',phone:'+91 90000 11111',address:'Pune'}});
  ok(result.response.status===201,'supplier creation');supplierId=result.result.id;
  result=await request(`/suppliers/${supplierId}`,{method:'PATCH',body:{company:'QA Trading Updated'}});ok(result.response.status===200&&result.result.company==='QA Trading Updated','supplier update');
  result=await request('/products',{method:'POST',body:{sku:`QA-${Date.now()}`,name:'QA stock fixture',category:'General',unit:'unit',costPrice:12,salePrice:27,stockQty:10,reorderLevel:3,supplierId}});
  ok(result.response.status===201,'product creation with opening stock ledger');productId=result.result.id;
  const eventPromise=(async()=>{let text='';while(!text.includes('inventory.changed')){const part=await reader.read();if(part.done)break;text+=new TextDecoder().decode(part.value)}return text})();
  result=await request(`/products/${productId}/adjust`,{method:'POST',body:{direction:'in',quantity:3,reference:'QA-IN',note:'test receipt'}});
  ok(result.response.status===200&&Number(result.result.stock_qty)===13,'stock adjustment adds inventory');
  const eventText=await Promise.race([eventPromise,new Promise((_,reject)=>setTimeout(()=>reject(new Error('SSE event timeout')),2500))]);ok(eventText.includes('inventory.changed'),'inventory changes publish live without reload');
  result=await request(`/products/${productId}/adjust`,{method:'POST',body:{direction:'out',quantity:1,reference:'QA-OUT',note:'cycle count'}});
  ok(result.response.status===200&&Number(result.result.stock_qty)===12,'stock adjustment removes inventory');
  result=await request(`/products/${productId}/adjust`,{method:'POST',body:{direction:'out',quantity:99}});ok(result.response.status===400,'adjustment cannot create negative inventory');
  result=await request(`/products/${productId}`,{method:'PATCH',body:{salePrice:29,name:'QA stock fixture updated'}});ok(result.response.status===200&&Number(result.result.sale_price)===29,'product update without directly mutating stock');
  result=await request(`/products/${productId}`,{method:'PATCH',body:{stockQty:100}});ok(result.response.status===400,'stock quantity can only change through tracked movements');

  result=await request('/purchase-orders',{method:'POST',body:{supplierId,expectedDate:new Date(Date.now()+14*86400000).toISOString().slice(0,10),items:[{productId,quantity:5,unitCost:14}]}});
  ok(result.response.status===201&&Number(result.result.total)===70,'purchase order creation and total');purchaseId=result.result.id;
  result=await request(`/purchase-orders/${purchaseId}/receive`,{method:'POST'});ok(result.response.status===200&&result.result.status==='Received','purchase order receipt updates status');
  const afterReceipt=(await request('/products?q=QA stock')).result.find(x=>x.id===productId);ok(Number(afterReceipt.stock_qty)===17,'receiving purchase increases product stock');
  ok((await request(`/purchase-orders/${purchaseId}/receive`,{method:'POST'})).response.status===409,'purchase receipt cannot be applied twice');

  result=await request('/sales-orders',{method:'POST',body:{customerName:'QA Customer',items:[{productId,quantity:2}]}});
  ok(result.response.status===201&&Number(result.result.total)===58,'sale order price calculation');saleId=result.result.id;
  const afterSale=(await request('/products?q=QA stock')).result.find(x=>x.id===productId);ok(Number(afterSale.stock_qty)===15,'sale deducts inventory and adds ledger event');
  result=await request('/sales-orders',{method:'POST',body:{customerName:'Oversell QA',items:[{productId,quantity:99}]}});ok(result.response.status===409,'sale cannot exceed available stock');
  ok((await request('/movements')).result.filter(m=>m.sku===afterSale.sku).length>=5,'stock movement history is complete');
  ok((await request('/sales-orders')).result.some(o=>o.id===saleId),'sales order listing');
  ok((await request('/purchase-orders')).result.some(o=>o.id===purchaseId),'purchase order listing');
  ok((await request('/dashboard')).result.stock_value!==undefined,'dashboard reflects live inventory values');

  await signIn('manager@stockpilot.local');ok((await request('/products')).response.ok,'manager read access');
  ok((await request(`/products/${productId}`,{method:'DELETE'})).response.status===403,'manager cannot archive products');
  await signIn('viewer@stockpilot.local');
  result=await request(`/products/${productId}/adjust`,{method:'POST',body:{direction:'in',quantity:1}});ok(result.response.status===403,'viewer cannot change stock');
  ok((await request('/products')).response.ok,'viewer can read inventory');

  await signIn();
  result=await request(`/products/${productId}`,{method:'PATCH',body:{supplierId:null}});ok(result.response.status===200,'product can be unlinked from supplier');
  result=await request(`/products/${productId}`,{method:'DELETE'});ok(result.response.status===204,'owner archives product');
  result=await request(`/suppliers/${supplierId}`,{method:'DELETE'});ok(result.response.status===204,'owner archives unused supplier');
  await request('/auth/logout',{method:'POST'});cookie='';ok((await request('/auth/me')).response.status===401,'logout invalidates session');
  console.log(`\n${checks} StockPilot API checks passed.`);
}catch(e){console.error('\nStockPilot check failed:',e);process.exitCode=1}
finally{
  if(saleId)await db.query('DELETE FROM sales_orders WHERE id=$1',[saleId]).catch(()=>{});
  if(purchaseId)await db.query('DELETE FROM purchase_orders WHERE id=$1',[purchaseId]).catch(()=>{});
  if(productId){await db.query('DELETE FROM stock_movements WHERE product_id=$1',[productId]).catch(()=>{});await db.query('DELETE FROM products WHERE id=$1',[productId]).catch(()=>{})}
  if(supplierId)await db.query('DELETE FROM suppliers WHERE id=$1',[supplierId]).catch(()=>{});
  await db.end();
}
