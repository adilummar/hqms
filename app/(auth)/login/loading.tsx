import { Skeleton } from "@/components/ui/skeleton";

export default function LoginLoading() {
  return (
    <div className="min-h-screen bg-background flex items-center justify-center px-4">
      <div className="w-full max-w-sm">
        <div className="text-center mb-10">
          <Skeleton className="h-12 w-24 mx-auto mb-2" />
          <Skeleton className="h-4 w-48 mx-auto" />
        </div>
        <div className="bg-card border border-border rounded-lg p-8">
          <Skeleton className="h-6 w-24 mb-2" />
          <Skeleton className="h-4 w-48 mb-6" />
          <div className="space-y-5">
            <div className="space-y-1.5">
              <Skeleton className="h-4 w-20" />
              <Skeleton className="h-11 w-full" />
            </div>
            <div className="space-y-1.5">
              <Skeleton className="h-4 w-20" />
              <Skeleton className="h-11 w-full" />
            </div>
            <Skeleton className="h-11 w-full" />
          </div>
        </div>
      </div>
    </div>
  );
}
