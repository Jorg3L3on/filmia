import type { ReactNode } from "react";

declare module "react" {
  export type ViewTransitionClass =
    | "none"
    | "auto"
    | (string & {});

  export type ViewTransitionProps = {
    children?: ReactNode;
    name?: "auto" | (string & {});
    default?: ViewTransitionClass;
    enter?: ViewTransitionClass;
    exit?: ViewTransitionClass;
    share?: ViewTransitionClass;
    update?: ViewTransitionClass;
  };

  export const ViewTransition: (props: ViewTransitionProps) => ReactNode;
}
