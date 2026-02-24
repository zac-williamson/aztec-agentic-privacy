// Use the correct subpath imports for aztec.js v4
import { createPXEClient } from '@aztec/aztec.js/node';

const PXE_URL = 'http://localhost:8080';

async function main() {
  console.log('Testing PXE connection at:', PXE_URL);
  const pxe = createPXEClient(PXE_URL);
  
  try {
    const info = await pxe.getNodeInfo();
    console.log('SUCCESS - Node info:', JSON.stringify(info, (k, v) => typeof v === 'bigint' ? v.toString() : v, 2));
  } catch (e) {
    console.log('ERROR:', e.message);
  }
}

main().catch(console.error);
