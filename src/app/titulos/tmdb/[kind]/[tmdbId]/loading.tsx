import { FichaLoadingPoster } from "@/components/ficha/FichaLoadingPoster";
import { FichaBodySkeleton } from "@/components/PageSkeletons";

/** A preview ficha's skeleton: the tapped poster already in its place when one flew here (FIL-I60-6). */
export default function TitleLoading() {
  return <FichaBodySkeleton poster={<FichaLoadingPoster />} />;
}
