const IconWrapper = ({
  children,
  Icon,
  size = 22,
  color,
}: {
  children?: React.ReactNode;
  Icon: React.ElementType;
  size?: number;
  color?: string;
}) => {
  return (
    <>
      <Icon size={size} color={color} />
      {children}
    </>
  );
};

export default IconWrapper;
