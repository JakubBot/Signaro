const LinkRenderer = ({
  href,
  children,
  target = "_blank",
}: {
  href: string;
  children: React.ReactNode;
  target?: "_blank" | "_self" | "_parent" | "_top";
}) => {
  if (href) {
    return (
      <a href={href} target={target} rel="noopener noreferrer">
        {children}
      </a>
    );
  }

  return children;
};

export default LinkRenderer;
