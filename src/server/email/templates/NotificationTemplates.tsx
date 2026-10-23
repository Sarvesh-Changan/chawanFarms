import { Body, Container, Head, Heading, Html, Preview, Text } from "@react-email/components";

type NotificationTemplateProps = { title: string; body: string };

function NotificationTemplate({ title, body }: NotificationTemplateProps) {
  return <Html><Head /><Preview>{title}</Preview><Body style={{ backgroundColor: "#fbf6ea", color: "#1b1b18", fontFamily: "Arial, sans-serif", padding: "32px 16px" }}><Container><Heading style={{ color: "#1f4d33" }}>{title}</Heading>{body.split("\n").map((line, index) => <Text key={`${index}-${line}`}>{line || " "}</Text>)}</Container></Body></Html>;
}

export const BookingReceivedEmail = (props: NotificationTemplateProps) => <NotificationTemplate {...props} />;
export const BookingConfirmedEmail = (props: NotificationTemplateProps) => <NotificationTemplate {...props} />;
export const BookingCancelledEmail = (props: NotificationTemplateProps) => <NotificationTemplate {...props} />;
export const VideoReceivedEmail = (props: NotificationTemplateProps) => <NotificationTemplate {...props} />;
export const VideoApprovedEmail = (props: NotificationTemplateProps) => <NotificationTemplate {...props} />;
export const VideoRejectedEmail = (props: NotificationTemplateProps) => <NotificationTemplate {...props} />;
export const PointsEarnedEmail = (props: NotificationTemplateProps) => <NotificationTemplate {...props} />;
export const CouponIssuedEmail = (props: NotificationTemplateProps) => <NotificationTemplate {...props} />;
export const CouponExpiringEmail = (props: NotificationTemplateProps) => <NotificationTemplate {...props} />;
export const PreArrivalReminderEmail = (props: NotificationTemplateProps) => <NotificationTemplate {...props} />;
export const EnquiryAcknowledgementEmail = (props: NotificationTemplateProps) => <NotificationTemplate {...props} />;
export const LeadAlertEmail = (props: NotificationTemplateProps) => <NotificationTemplate {...props} />;
