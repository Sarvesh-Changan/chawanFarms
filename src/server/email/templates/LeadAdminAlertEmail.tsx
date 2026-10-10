import { Body, Container, Head, Heading, Html, Preview, Text } from "@react-email/components";

export function LeadAdminAlertEmail({ name, phone, email, reference, formType, message }: { name: string; phone: string; email: string; reference: string; formType: string; message: string }) {
  return <Html><Head/><Preview>New website enquiry {reference}</Preview><Body style={{ backgroundColor: "#fbf6ea", color: "#1b1b18", fontFamily: "Arial, sans-serif", padding: "32px 16px" }}><Container><Heading style={{ color: "#1f4d33" }}>New website enquiry</Heading><Text>Reference: <strong>{reference}</strong></Text><Text>Form: {formType}</Text><Text>Name: {name}</Text><Text>Phone: {phone}</Text>{email ? <Text>Email: {email}</Text> : null}{message ? <Text>Message: {message}</Text> : null}</Container></Body></Html>;
}
