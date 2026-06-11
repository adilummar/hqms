"use client";

import { useState, useTransition } from "react";
import { createUser } from "@/lib/actions/users";
import { toast } from "sonner";
import { Loader2 } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";

type UserRole = "super_admin" | "admin" | "tutor" | "parent";

export function AddUserDialog() {
  const [open, setOpen] = useState(false);
  const [isPending, startTransition] = useTransition();

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const formData = new FormData(e.currentTarget);
    
    const data = {
      username: formData.get("username") as string,
      email: formData.get("email") as string,
      password: formData.get("password") as string,
      role: formData.get("role") as UserRole,
    };

    startTransition(async () => {
      const res = await createUser(data);
      if (res.success) {
        toast.success("User created successfully");
        setOpen(false);
      } else {
        toast.error(res.error || "Failed to create user");
      }
    });
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger render={<button className="px-3 py-1.5 bg-foreground text-background text-sm rounded-sm hover:bg-foreground/90 transition-colors" />}>
        + Add User
      </DialogTrigger>
      <DialogContent className="sm:max-w-[425px]">
        <DialogHeader>
          <DialogTitle>Add New User</DialogTitle>
          <DialogDescription>
            Create a new system user. They can use these credentials to log in.
          </DialogDescription>
        </DialogHeader>
        
        <form onSubmit={handleSubmit} className="space-y-4 mt-4">
          <div>
            <label className="block text-xs font-medium mb-1">Username</label>
            <input 
              name="username" 
              required 
              minLength={3}
              placeholder="e.g. tutor1"
              className="w-full h-9 px-3 border border-border rounded-sm text-sm focus:outline-none focus:ring-1 focus:ring-foreground" 
            />
          </div>
          
          <div>
            <label className="block text-xs font-medium mb-1">Email (Optional)</label>
            <input 
              name="email" 
              type="email"
              placeholder="e.g. tutor1@example.com"
              className="w-full h-9 px-3 border border-border rounded-sm text-sm focus:outline-none focus:ring-1 focus:ring-foreground" 
            />
          </div>

          <div>
            <label className="block text-xs font-medium mb-1">Password</label>
            <input 
              name="password" 
              type="password"
              required 
              minLength={6}
              placeholder="At least 6 characters"
              className="w-full h-9 px-3 border border-border rounded-sm text-sm focus:outline-none focus:ring-1 focus:ring-foreground" 
            />
          </div>

          <div>
            <label className="block text-xs font-medium mb-1">Role</label>
            <select 
              name="role" 
              required
              defaultValue="tutor"
              className="w-full h-9 px-3 border border-border rounded-sm text-sm focus:outline-none focus:ring-1 focus:ring-foreground bg-background"
            >
              <option value="tutor">Tutor</option>
              <option value="admin">Admin</option>
              <option value="super_admin">Super Admin</option>
            </select>
          </div>

          <div className="flex justify-end gap-3 pt-4">
            <button 
              type="button" 
              onClick={() => setOpen(false)}
              className="px-4 py-2 border border-border text-sm font-medium rounded-sm hover:bg-muted transition-colors"
            >
              Cancel
            </button>
            <button 
              type="submit" 
              disabled={isPending}
              className="px-4 py-2 bg-foreground text-background text-sm font-medium rounded-sm hover:bg-foreground/90 transition-colors disabled:opacity-50 flex items-center gap-2"
            >
              {isPending && <Loader2 size={14} className="animate-spin" />}
              Create User
            </button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
