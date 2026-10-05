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

type VerifyEmailEmailProps = { name: string; url: string };

const main: CSSProperties = {
  backgroundColor: "#fbf6ea",
  color: "#1b1b18",
  fontFamily: "Arial, sans-serif",
  padding: "32px 16px",
};

export function VerifyEmailEmail({ name, url }: VerifyEmailEmailProps) {
  return (
    <Html>
      <Head />
      <Preview>Verify your Chawan Farms email address</Preview>
      <Body style={main}>
        <Container>
          <Heading>Welcome to Chawan Farms, {name}</Heading>
          <Text>Confirm your email address to finish creating your account.</Text>
          <Section>
            <Button href={url} style={{ backgroundColor: "#1f4d33", color: "#fbf6ea", padding: "12px 20px", borderRadius: "8px" }}>
              Verify email address
            </Button>
          </Section>
          <Text>This link expires in 24 hours.</Text>
        </Container>
      </Body>
    </Html>
  );
}
