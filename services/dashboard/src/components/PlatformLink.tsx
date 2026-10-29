"use client";
import NextLink from "next/link";
import { ComponentProps } from "react";
import { usePlatform } from "@/lib/platform";
import { platformHref } from "@/lib/platform-routes";
export default function PlatformLink(props: ComponentProps<typeof NextLink>) {
  const { platform } = usePlatform();
  return <NextLink {...props} href={typeof props.href === "string" ? platformHref(props.href, platform) : props.href} />;
}
