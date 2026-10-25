import { measureToastFit } from "../src/components/toast/measure-toast-fit";

const main = async () => {
  await measureToastFit();
};

main().catch((error: unknown) => {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
});
