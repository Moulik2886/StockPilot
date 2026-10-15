import pg from 'pg';
import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import bcrypt from 'bcryptjs';

export const pool = new pg.Pool({connectionString:process.env.DATABASE_URL,max:Number(process.env.DB_POOL_SIZE||1)});
const here=path.dirname(fileURLToPath(import.meta.url));

export async function initializeDatabase(){
  await pool.query(await fs.readFile(path.join(here,'../sql/schema.sql'),'utf8'));
  if((await pool.query('SELECT id FROM workspaces LIMIT 1')).rowCount)return;
  const c=await pool.connect();
  try{
    await c.query('BEGIN');
    const workspace=(await c.query("INSERT INTO workspaces(name) VALUES('Northstar Retail Co.') RETURNING id")).rows[0].id;
    const people=[['Maya Shah','owner@stockpilot.local','owner'],['Aarav Mehta','manager@stockpilot.local','manager'],['Riya Patel','viewer@stockpilot.local','viewer']];
    const users={};for(const[name,email,role]of people)users[role]=(await c.query('INSERT INTO users(workspace_id,name,email,password_hash,role) VALUES($1,$2,$3,$4,$5) RETURNING id',[workspace,name,email,await bcrypt.hash('StockPilot!2026',10),role])).rows[0].id;
    const supplierIds=[];
    for(const[name,email,phone,company,address]of [['Urban Supply House','ops@urban.example','+91 22 4000 1600','Urban Supply','Mumbai'],['Greenline Wholesale','orders@greenline.example','+91 20 4550 8200','Greenline','Pune'],['PixelParts India','hello@pixelparts.example','+91 79 6120 3310','PixelParts','Ahmedabad']])supplierIds.push((await c.query('INSERT INTO suppliers(workspace_id,name,email,phone,company,address) VALUES($1,$2,$3,$4,$5,$6) RETURNING id',[workspace,name,email,phone,company,address])).rows[0].id);
    const products=[];
    for(const [sku,name,category,unit,cost,sale,stock,reorder,supplier] of [
      ['DSK-001','Ergonomic standing desk','Furniture','unit',18000,28900,24,8,supplierIds[0]],
      ['CHR-014','Mesh task chair','Furniture','unit',7200,11900,38,12,supplierIds[0]],
      ['MON-027','27-inch 4K monitor','Electronics','unit',21800,32900,12,6,supplierIds[2]],
      ['KEY-032','Wireless mechanical keyboard','Electronics','unit',3600,6490,7,10,supplierIds[2]],
      ['LMP-008','Architect desk lamp','Lighting','unit',2100,3890,31,10,supplierIds[1]],
      ['CBL-105','USB-C braided cable','Accessories','unit',240,690,94,25,supplierIds[2]],
      ['MSE-018','Precision wireless mouse','Electronics','unit',1250,2490,3,8,supplierIds[2]],
      ['ORG-020','Modular desk organizer','Accessories','unit',680,1490,55,15,supplierIds[1]]
    ])products.push((await c.query('INSERT INTO products(workspace_id,sku,name,category,unit,cost_price,sale_price,stock_qty,reorder_level,supplier_id) VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9,$10) RETURNING id,stock_qty',[workspace,sku,name,category,unit,cost,sale,stock,reorder,supplier])).rows[0]);
    for(const p of products)await c.query("INSERT INTO stock_movements(workspace_id,product_id,user_id,kind,quantity,before_qty,after_qty,reference,note) VALUES($1,$2,$3,'opening',$4,0,$4,'OPENING','Initial stock')",[workspace,p.id,users.owner,p.stock_qty]);
    await c.query('INSERT INTO document_counters(workspace_id,year,po_number,order_number) VALUES($1,EXTRACT(YEAR FROM CURRENT_DATE)::int,1008,248)',[workspace]);
    await c.query('COMMIT');console.log('Seeded StockPilot demo workspace.');
  }catch(error){await c.query('ROLLBACK');throw error}finally{c.release()}
}
