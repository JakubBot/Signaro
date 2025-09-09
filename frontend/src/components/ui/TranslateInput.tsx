import ContentWrapper from "@/components/ui/ContentWrapper";
import { typography } from "@/components/ui/typography";
import { css } from "@emotion/react";
import { cameraSize } from "@/constants/webrtc";
import { colorPalette } from "@/components/ui/colorPalette";

const inputFooterHeight = 40;
const padding = 10;
const TranslateInput = ({
  value,
  onChange,
  title,
  maxLength = 500,
}: {
  value: string;
  onChange: (value: string) => void;
  title?: string;
  maxLength?: number;
}) => {
  return (
    <ContentWrapper gap="5px" direction="column">
      {title && <h4 css={typography.textL}>{title}</h4>}

      <ContentWrapper
        direction="column"
        padding={`${padding}px`}
        borderRadius="var(--radius)"
        backgroundColor={colorPalette.lightGray}
      >
        <textarea
          aria-label="Tekst źródłowy"
          aria-autocomplete="list"
          autoCapitalize="off"
          autoComplete="off"
          autoCorrect="off"
          placeholder="Translation..."
          disabled
          css={css`
            width: ${cameraSize.width -
            2 * padding}px; // left and right padding
            height: ${cameraSize.height - inputFooterHeight - padding}px;
            background-color: ${colorPalette.lightGray};
            // border-radius: var(--radius);
            // padding: 10px;
            font-size: 16px;
            resize: none;

            &:focus {
              outline: none;
              box-shadow: none;
            }
          `}
          value={value}
          onChange={(e) => {
            if (e.target.value.length <= maxLength) {
              onChange(e.target.value);
            }
          }}
        ></textarea>

        <ContentWrapper
          height={`${inputFooterHeight - padding}px`}
          backgroundColor={colorPalette.lightGray}
          align="flex-end"
        >
          <span
            css={[
              typography.textS,
              css`
                line-height: initial;
                color: ${colorPalette.darkGray};
              `,
            ]}
          >
            {value.length} / {maxLength} characters
          </span>
        </ContentWrapper>
      </ContentWrapper>
    </ContentWrapper>
  );
};

export default TranslateInput;
