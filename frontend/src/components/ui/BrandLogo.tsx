"use client";
import { MdOutlineSignLanguage } from "react-icons/md";
import { typography } from "@/components/ui/typography";
import { css } from "@emotion/react";
import IconWrapper from "@/components/ui/IconWrapper";
import ContentWrapper from "@/components/ui/ContentWrapper";
import { colorPalette } from "./colorPalette";

interface BrandLogoProps {
  onClick?: () => void;
}

const BrandLogo = ({ onClick }: BrandLogoProps) => {
  return (
    <ContentWrapper onClick={onClick} align="center" gap="10px">
      <IconWrapper Icon={MdOutlineSignLanguage} />
      <span css={[typography.textXl, css``]}>Signaro</span>
    </ContentWrapper>
  );
};

export default BrandLogo;
