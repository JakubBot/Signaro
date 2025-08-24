import styled from "@emotion/styled";
import { colorPalette } from "@/components/ui/colorPalette";
import { FaSignLanguage } from "react-icons/fa";
import { MdOutlineSignLanguage } from "react-icons/md";

import { Button } from "@/components/ui/button";
import BrandLogo from "../ui/BrandLogo";

const NavbarWrapperStyles = styled.div`
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 12px 16px;
  background-color: ${colorPalette.darkGray};
  min-height: 70px;
`;

const Navbar = () => {
  return (
    <>
      <NavbarWrapperStyles>
        <BrandLogo />
        <nav></nav>
      </NavbarWrapperStyles>
    </>
  );
};

export default Navbar;
