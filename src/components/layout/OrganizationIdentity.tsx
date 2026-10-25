"use client";

import { useEffect } from "react";
import { usePathname } from "next/navigation";

export function OrganizationIdentity({ name }: { name: string }) {
  const pathname = usePathname();

  useEffect(() => {
    const previousTitle = document.title;
    document.title = `${name} | CRM`;
    return () => {
      document.title = previousTitle;
    };
  }, [name, pathname]);

  return null;
}
