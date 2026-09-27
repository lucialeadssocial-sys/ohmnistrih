// scripts/run-credential-verification.ts
import { runAICredentialManagerVerificationSuite } from "../src/utils/AICredentialManagerVerificationSuite";

async function main() {
  console.log("=== OMNISTRIH MULTI-AI CREDENTIAL MANAGER VERIFICATION SUITE ===");
  const summary = await runAICredentialManagerVerificationSuite();
  console.log(`\nResult Status: ${summary.status}`);
  console.log(`Passed: ${summary.passed}/${summary.total}`);
  console.log(`Failed: ${summary.failed}/${summary.total}\n`);

  summary.results.forEach((r) => {
    const symbol = r.status === "PASS" ? "✅" : "❌";
    console.log(`${symbol} [${r.category}] #${r.id} ${r.name}: ${r.details}`);
  });

  if (summary.status !== "VERIFIED") {
    console.error("\n❌ Verification suite failed!");
    process.exit(1);
  } else {
    console.log("\n🎉 All 12/12 verification checks PASSED successfully!");
  }
}

main().catch((err) => {
  console.error("Fatal error running test suite:", err);
  process.exit(1);
});
