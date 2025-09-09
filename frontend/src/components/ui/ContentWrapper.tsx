import { css } from "@emotion/react";

const ContentWrapper = ({
  children,
  position,
  align,
  justify,
  padding,
  margin,
  width,
  height,
  gap,
  direction,
  onClick,
}: {
  children: React.ReactNode;
  position?: string;
  align?: string;
  justify?: string;
  padding?: string;
  margin?: string;
  width?: string;
  height?: string;
  gap?: string;
  direction?: "row" | "column";
  onClick?: () => void;
}) => {
  return (
    <div
      onClick={onClick}
      css={css`
        ${position ? `position: ${position};` : ""}
        ${align ? `align-items: ${align};` : ""}
    ${justify ? `justify-content: ${justify};` : ""}
    ${padding ? `padding: ${padding};` : ""}
    ${margin ? `margin: ${margin};` : ""}
    ${width ? `width: ${width};` : ""}
    ${height ? `height: ${height};` : ""}
    ${gap ? `gap: ${gap};` : ""}
    ${direction ? `flex-direction: ${direction};` : ""}

    ${align || justify ? `display: flex;` : ""}
      `}
    >
      {children}
    </div>
  );
};

export default ContentWrapper;
