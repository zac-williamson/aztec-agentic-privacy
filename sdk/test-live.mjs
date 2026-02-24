import { createPXEClient } from './node_modules/@aztec/aztec.js/dest/api/contract.js';

const pxe = createPXEClient('http://localhost:8080');

try {
  const info = await pxe.getPXEInfo();
  console.log('SUCCESS - PXE info keys:', Object.keys(info || {}));
  console.log('PXE info:', JSON.stringify(info, (k,v) => typeof v === 'bigint' ? v.toString() : v, 2));
} catch(e) {
  console.log('getPXEInfo ERROR:', e.message?.slice(0, 200));
}

try {
  const accounts = await pxe.getRegisteredAccounts();
  console.log('Registered accounts:', accounts.length);
} catch(e) {
  console.log('getRegisteredAccounts ERROR:', e.message?.slice(0, 200));
}
