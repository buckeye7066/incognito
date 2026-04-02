import { Toaster as Sonner } from "sonner"

const Toaster = ({ ...props }) => {
  return (
    <Sonner
      theme="dark"
      className="toaster group"
      toastOptions={{
        classNames: {
          toast:
            "group toast group-[.toaster]:bg-slate-900 group-[.toaster]:text-white group-[.toaster]:border-purple-500/30 group-[.toaster]:shadow-lg",
          description: "group-[.toast]:text-purple-300",
          actionButton:
            "group-[.toast]:bg-purple-600 group-[.toast]:text-white",
          cancelButton:
            "group-[.toast]:bg-slate-800 group-[.toast]:text-purple-300",
        },
      }}
      {...props}
    />
  );
};

export { Toaster }
