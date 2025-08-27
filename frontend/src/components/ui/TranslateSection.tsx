import { css } from "@emotion/react";
import { colorPalette } from "./colorPalette";

const TranslateSection = ({ children }: { children: React.ReactNode }) => {
  return (
    <div
      css={[
        css`
          border: 1px solid ${colorPalette.darkGray}; 
          min-height: clamp(250px, 50vh, 557px);
        `,
      ]}
    >
      {children}
    </div>
  );
};

export default TranslateSection;
