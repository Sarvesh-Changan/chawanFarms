import { Button, Container, Head, Heading, Html, Preview, Section, Text } from "@react-email/components";

export function StaffInviteEmail({ url, expiresInHours = 72 }: { url: string; expiresInHours?: number }) {
  return (
    <Html>
      <Head />
      <Preview>You have been invited to the Chawan Farms staff workspace</Preview>
      <Container style={{ margin: "32px auto", maxWidth: "560px", padding: "24px", fontFamily: "Arial, sans-serif", color: "#1b1b18" }}>
        <Heading style={{ color: "#1f4d33", fontSize: "24px" }}>Staff workspace invitation</Heading>
        <Text>Use the secure link below to accept your invitation. The link expires in {expiresInHours} hours and can only be used once.</Text>
        <Section style={{ margin: "28px 0" }}><Button href={url} style={{ backgroundColor: "#e9a21b", borderRadius: "8px", color: "#1b1b18", padding: "12px 18px", textDecoration: "none" }}>Accept invitation</Button></Section>
        <Text style={{ color: "#6b7a72", fontSize: "12px" }}>If you were not expecting this invitation, you can ignore this message.</Text>
      </Container>
    </Html>
  );
}
