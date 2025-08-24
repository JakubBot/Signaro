"use client";
import { MdOutlineSignLanguage } from "react-icons/md";
import { typography } from "@/components/ui/typography";
import { css } from "@emotion/react";

interface BrandLogoProps {
  onClick?: () => void;
}

const BrandLogo = ({ onClick }: BrandLogoProps) => {
  return (
    <div onClick={onClick} className="flex items-center gap-4">
      <MdOutlineSignLanguage size={20} />
      <span
        css={[
          typography.textM,
          css`
          `,
        ]}
      >
        Signaro
      </span>
    </div>
  );
};

export default BrandLogo;
