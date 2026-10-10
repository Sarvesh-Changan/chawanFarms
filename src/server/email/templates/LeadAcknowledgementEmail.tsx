import { Body, Container, Head, Heading, Html, Preview, Text } from "@react-email/components";

export function LeadAcknowledgementEmail({ name, reference }: { name: string; reference: string }) {
  return <Html><Head/><Preview>We received your Chawan Farms enquiry</Preview><Body style={{ backgroundColor: "#fbf6ea", color: "#1b1b18", fontFamily: "Arial, sans-serif", padding: "32px 16px" }}><Container><Heading style={{ color: "#1f4d33" }}>Thank you, {name}</Heading><Text>Your enquiry has been received. The team will follow up using the contact details you provided.</Text><Text>Reference: <strong>{reference}</strong></Text></Container></Body></Html>;
}
