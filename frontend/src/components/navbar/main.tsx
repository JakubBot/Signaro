import styled from "@emotion/styled";
import { colorPalette } from "@/components/ui/colorPalette";
import { FaSignLanguage } from "react-icons/fa";
import { MdOutlineSignLanguage } from "react-icons/md";

import BrandLogo from "../ui/BrandLogo";
import MenuHamburger from "@/components/navbar/MenuHamburger";
import ContentWrapper from "@/components/ui/ContentWrapper";

const NavbarWrapperStyles = styled.div`
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 0 20px;
  height: 60px;

  border-bottom: 1px solid ${colorPalette.border};
`;

const Navbar = () => {
  return (
    <>
      <NavbarWrapperStyles>
        <BrandLogo />

        <nav></nav>
        <ContentWrapper align="center" gap="25px">
          <MenuHamburger />
        </ContentWrapper>
      </NavbarWrapperStyles>
    </>
  );
};

export default Navbar;
