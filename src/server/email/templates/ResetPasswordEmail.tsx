import {
  Body,
  Button,
  Container,
  Head,
  Heading,
  Html,
  Preview,
  Section,
  Text,
} from "@react-email/components";
import type { CSSProperties } from "react";

type ResetPasswordEmailProps = { name: string; url: string };

const main: CSSProperties = {
  backgroundColor: "#fbf6ea",
  color: "#1b1b18",
  fontFamily: "Arial, sans-serif",
  padding: "32px 16px",
};

export function ResetPasswordEmail({ name, url }: ResetPasswordEmailProps) {
  return (
    <Html>
      <Head />
      <Preview>Reset your Chawan Farms password</Preview>
      <Body style={main}>
        <Container>
          <Heading>Password reset requested</Heading>
          <Text>Hi {name}, use the button below to choose a new password.</Text>
          <Section>
            <Button href={url} style={{ backgroundColor: "#1f4d33", color: "#fbf6ea", padding: "12px 20px", borderRadius: "8px" }}>
              Reset password
            </Button>
          </Section>
          <Text>This link expires in 30 minutes and can only be used once.</Text>
        </Container>
      </Body>
    </Html>
  );
}
