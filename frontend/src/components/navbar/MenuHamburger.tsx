import { LuMenu } from "react-icons/lu";
import IconWrapper from "@/components/ui/IconWrapper";
import { useState } from "react";
import { SidebarMenu } from "@/components/ui/SidebarMenu";
import BrandLogo from "@/components/ui/BrandLogo";

const MenuHamburger = () => {
  const menuItems = [
    { label: "Signaro - information", href: "/" },
    { type: "divider" },
    { label: "Home", href: "/" }, // onClick: () => 0
    { label: "About", href: "/about" },
    { label: "Contact", href: "/contact" },
  ];
  return (
    <>
      <SidebarMenu
        title={<BrandLogo />}
        trigger={<IconWrapper Icon={LuMenu} size={24} />}
        menuItems={menuItems}
        side="right"
        hasCloseButton
      />
    </>
  );
};

export default MenuHamburger;
