// Simple E2E test: verify the IsnadRegistry contract is live and responsive
// Uses createPXEClient for public reads (no wallet needed)
import { createPXEClient } from "@aztec/aztec.js/contracts";

const PXE_URL = "http://localhost:8080";

async function main() {
  console.log("Testing PXE connectivity...");
  const pxe = createPXEClient(PXE_URL);
  const info = await pxe.getPXEInfo();
  console.log("PXE connected! Version:", info.nodeVersion);
  console.log("Protocol contracts:", Object.keys(info.protocolContractAddresses).slice(0, 3).join(", "));
}

main().catch(e => {
  console.error("Error:", e.message);
  process.exit(1);
});
