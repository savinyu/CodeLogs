import { cn } from "cn";

/** The page column every route renders into: Coach's 1120px wrap with a 16px gutter. */
export function Page({ className, ...props }: React.ComponentProps<"main">) {
  return (
    <main className={cn("mx-auto w-full max-w-[70rem] px-4 pt-3 pb-18", className)} {...props} />
  );
}
