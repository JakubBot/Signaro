import { colorPalette } from "@/components/ui/colorPalette";
import { css } from "@emotion/react";

const Divider = () => {
  return (
    <>
      <div
        css={css`
          border-bottom: 1px solid ${colorPalette.border};
        `}
      ></div>
    </>
  );
};

export default Divider;
