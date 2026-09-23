import test from 'node:test';
import assert from 'node:assert/strict';
import { filterMenu, menuAvailability, menuCategories, type Product } from '../src/features/operations/domain';

test('category filter combines with search and All includes unassigned products', () => {
  const base = { business_id:'business', description:'', price_centavos:100, active:true, photo_path:null, version:1 };
  const products: Product[] = [
    {...base,id:'1',name:'Rice Meal',category:'Rice Meals'},
    {...base,id:'2',name:'Iced Drink',category:'Drinks'},
    {...base,id:'3',name:'Special',category:null},
  ];
  assert.equal(filterMenu(products,'','All').length,3);
  assert.deepEqual(filterMenu(products,' RICE ','Rice Meals').map(p=>p.id),['1']);
  assert.deepEqual(filterMenu(products,'rice','Drinks'),[]);
  assert.deepEqual(filterMenu(products,'','Desserts'),[]);
  assert.deepEqual(menuCategories(products),['Drinks','Rice Meals']);
  assert.deepEqual(menuCategories([]),[]);
  assert.deepEqual(menuCategories([...products,{...base,id:'4',name:'Latte',category:'Coffee'},{...base,id:'5',name:'Mocha',category:'Coffee'}]),['Coffee','Drinks','Rice Meals']);
});

test('menu availability requires positive remaining quantity', () => {
  const product = { active:true };
  assert.deepEqual(menuAvailability(product), { remaining:0, status:'unavailable' });
  assert.deepEqual(menuAvailability(product, { total:0, used:0 }), { remaining:0, status:'unavailable' });
  assert.deepEqual(menuAvailability(product, { total:4, used:4 }), { remaining:0, status:'unavailable' });
  assert.deepEqual(menuAvailability(product, { total:4, used:1 }), { remaining:3, status:'low-stock' });
  assert.deepEqual(menuAvailability(product, { total:8, used:1 }), { remaining:7, status:'available' });
  assert.deepEqual(menuAvailability({ active:false }, { total:8, used:1 }), { remaining:7, status:'paused' });
  assert.deepEqual(menuAvailability(product, { total:2, used:3 }), { remaining:0, status:'unavailable' });
});
