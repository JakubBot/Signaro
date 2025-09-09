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
  direction = "row",
  maxWidth,
  flex,
  borderRadius,
  backgroundColor,
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
  maxWidth?: string;
  flex?: true;
  backgroundColor?: string;
  borderRadius?: string;
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
    ${maxWidth ? `max-width: ${maxWidth};` : ""}
    ${height ? `height: ${height};` : ""}
    ${gap ? `gap: ${gap};` : ""}
    ${direction ? `flex-direction: ${direction};` : ""}
    ${borderRadius ? `border-radius: ${borderRadius};` : ""}
    ${backgroundColor ? `background-color: ${backgroundColor};` : ""}

    ${align || justify || flex || gap || direction ? `display: flex;` : ""}
      `}
    >
      {children}
    </div>
  );
};

export default ContentWrapper;
