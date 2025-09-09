import {
  Sheet,
  SheetContent,
  SheetTrigger,
  SheetHeader,
  SheetTitle,
  SheetDescription,
  SheetFooter,
  SheetClose,
} from "@/components/ui/shadcn/sheet";
import { Button } from "@/components/ui/shadcn/button";
import React from "react";
import { css } from "@emotion/react";
import ContentWrapper from "@/components/ui/ContentWrapper";
import { typography } from "@/components/ui/typography";
import Divider from "@/components/ui/Divider";
import LinkRenderer from "@/components/ui/LinkRenderer";

type MenuElement = {
  label?: string;
  icon?: React.ReactNode;
  onClick?: () => void;
  href?: string;
};

type MenuRenderItem = MenuElement | { type: "divider" };

interface SidebarMenuProps {
  title?: string | React.ReactNode;
  description?: string;
  menuItems: MenuRenderItem[];
  side?: "left" | "right";
  width?: string;
  trigger?: React.ReactNode;
  hasCloseButton?: boolean;
}

function isDivider(item: MenuRenderItem): item is { type: "divider" } {
  return "type" in item && item.type === "divider";
}

export const SidebarMenu: React.FC<SidebarMenuProps> = ({
  title = "Menu",
  description,
  menuItems,
  side = "left",
  trigger,
  hasCloseButton = false,
}) => {
  return (
    <Sheet>
      <SheetTrigger asChild>
        {trigger ? <button aria-label="Menu">{trigger}</button> : null}
      </SheetTrigger>

      <SheetContent
        side={side}
        className={`p-4 bg-white dark:bg-gray-900 shadow-none`}
        css={css`
          box-shadow: 0 0 16px rgba(0, 0, 0, 0.28);
          display: flex;
          flex-direction: column;
        `}
      >
        {title && (
          <SheetHeader>
            <ContentWrapper justify="start" gap="20px" direction="column">
              <SheetTitle css={css``}>{title}</SheetTitle>
            </ContentWrapper>
          </SheetHeader>
        )}

        <nav className="mt-4 flex-1 flex flex-col space-y-2">
          {menuItems.map((item, idx) => {
            if (isDivider(item)) {
              return <Divider key={idx} />;
            }

            const content = (
              <>
                {item.icon && <span className="mr-2">{item.icon}</span>}
                {item.label}
              </>
            );

            return (
              <LinkRenderer key={idx} href={item.href ?? ""} target="_blank">
                <span
                  className="flex items-center m-0 rounded hover:bg-gray-100 dark:hover:bg-gray-800"
                  css={[
                    typography.textM,
                    css`
                      padding: 4px 4px 4px 24px;
                      line-height: 40px;
                    `,
                  ]}
                >
                  {content}
                </span>
              </LinkRenderer>
            );
          })}
        </nav>
        <SheetFooter>
          {hasCloseButton && (
            <SheetClose asChild>
              <Button className="w-full">Close</Button>
            </SheetClose>
          )}
        </SheetFooter>
      </SheetContent>
    </Sheet>
  );
};
