import { css } from "@emotion/react";

const MainContainer = ({ children }) => {
  return (
    <>
      <main
        css={[
          css`
            margin: 0 auto;
            max-width: 1400px;
            width: 100%;
          `,
        ]}
      >
        {children}
      </main>
    </>
  );
};

export default MainContainer;
