import styled from "@emotion/styled";
import { colorPalette } from "@/components/ui/colorPalette";
import { FaSignLanguage } from "react-icons/fa";

import { Button } from "@/components/ui/button";

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
        <Button variant="ghost">
          <FaSignLanguage /> Signaro
        </Button>

        <nav></nav>
      </NavbarWrapperStyles>
    </>
  );
};

export default Navbar;
