import { createPXEClient } from '@aztec/aztec.js';

const CONTRACT_ADDRESS = '0x05d66323796566fe663f938f82df1dee62ac052693c666e858a132317004ddea';
const PXE_URL = 'http://localhost:8080';

async function main() {
  console.log('Connecting to PXE at:', PXE_URL);
  const pxe = createPXEClient(PXE_URL);
  
  try {
    const info = await pxe.getNodeInfo();
    console.log('PXE node info:', JSON.stringify(info, (k, v) => typeof v === 'bigint' ? v.toString() : v, 2));
  } catch (e) {
    console.log('Error:', e.message);
  }
}

main().catch(console.error);
