package com.yit.deploy.plugin.steps.tasks;

import hudson.AbortException;
import jenkins.plugins.mailer.tasks.MimeMessageBuilder;
import org.apache.commons.lang.StringUtils;
import javax.mail.Address;
import javax.mail.Message;
import javax.mail.MessagingException;
import javax.mail.Transport;
import javax.mail.internet.MimeMessage;
import java.io.UnsupportedEncodingException;
import java.util.concurrent.ExecutionException;

public class MailTask extends AbstractJenkinsTask {

    private String charset;

    private String subject;

    private String body;

    private String from;

    private String to;

    private String cc;

    private String bcc;

    private String replyTo;

    private String mimeType;

    public void setCharset(String charset) {
        this.charset = charset;
    }

    public void setSubject(String subject) {
        this.subject = subject;
    }

    public void setBody(String body) {
        this.body = body;
    }

    public void setFrom(String from) {
        this.from = from;
    }

    public void setTo(String to) {
        this.to = to;
    }

    public void setCc(String cc) {
        this.cc = cc;
    }

    public void setBcc(String bcc) {
        this.bcc = bcc;
    }

    public void setReplyTo(String replyTo) {
        this.replyTo = replyTo;
    }

    public void setMimeType(String mimeType) {
        this.mimeType = mimeType;
    }

    /**
     * starts the step and blocking util the step to complete or throw exceptions if failed.
     */
    @Override
    public Object start() throws AbortException, UnsupportedEncodingException, MessagingException {
        MimeMessage mimeMessage = buildMimeMessage();
        Transport.send(mimeMessage);
        return null;
    }

    /**
     * gracefully stop this step if it is running from another thread.
     */
    @Override
    public void stop() {
    }

    private MimeMessage buildMimeMessage() throws UnsupportedEncodingException, MessagingException, AbortException {
        if (StringUtils.isBlank(subject) || StringUtils.isBlank(body)) {
            throw new AbortException("Email not sent. All mandatory properties must be supplied ('subject', 'body').");
        }

        MimeMessageBuilder messageBuilder = new MimeMessageBuilder().setListener(getTaskListener());

        if (subject != null) {
            messageBuilder.setSubject(subject);
        }
        if (body != null) {
            messageBuilder.setBody(body);
        }
        if (from != null) {
            messageBuilder.setFrom(from);
        }
        if (replyTo != null) {
            messageBuilder.setReplyTo(replyTo);
        }
        if (to != null) {
            messageBuilder.addRecipients(to, Message.RecipientType.TO);
        }
        if (cc != null) {
            messageBuilder.addRecipients(cc, Message.RecipientType.CC);
        }
        if (bcc != null) {
            messageBuilder.addRecipients(bcc, Message.RecipientType.BCC);
        }
        if (charset != null) {
            messageBuilder.setCharset(charset);
        }
        if (mimeType != null) {
            messageBuilder.setMimeType(mimeType);
        }

        MimeMessage message = messageBuilder.buildMimeMessage();

        Address[] allRecipients = message.getAllRecipients();
        if (allRecipients == null || allRecipients.length == 0) {
            throw new AbortException("Email not sent. No recipients of any kind specified ('to', 'cc', 'bcc').");
        }

        return message;
    }
}
