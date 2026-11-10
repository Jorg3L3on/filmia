import { FichaBodySkeleton } from "@/components/PageSkeletons";
import { FichaLoadingPoster } from "@/components/ficha/FichaLoadingPoster";

/** The tapped poster lands in the skeleton, so the cut list → ficha never meets a grey block (FIL-I46-2). */
export default function TitleLoading() {
  return <FichaBodySkeleton poster={<FichaLoadingPoster />} />;
}
