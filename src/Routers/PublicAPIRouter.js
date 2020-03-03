import PromiseRouter from '../PromiseRouter';
import Config from '../Config';
import express from 'express';
import path from 'path';
import fs from 'fs';
import qs from 'querystring';

const public_html = path.resolve(__dirname, "../../public_html");
const views = path.resolve(__dirname, '../../views');

export class PublicAPIRouter extends PromiseRouter {

  verifyEmail(req) {
    const { username, token: rawToken } = req.query;
    const token = rawToken && typeof rawToken !== 'string' ? rawToken.toString() : rawToken;
    const appId = req.params.appId;
    const config = new Config(appId);

    if (!config.publicServerURL) {
      return this.missingPublicServerURL();
    }

    if (!token || !username) {
      return this.invalidLink(req);
    }

    const userController = config.userController;
    return userController.verifyEmail(username, token).then(() => {
      const params = qs.stringify({username});
      return Promise.resolve({
        status: 302,
        location: `${config.verifyEmailSuccessURL}?${params}`
      });
    }, ()=> {
      return this.invalidLink(req);
    })
  }

  changePassword(req) {
    return new Promise((resolve, reject) => {
      const config = new Config(req.query.id);
      if (!config.publicServerURL) {
        return resolve({
          status: 404,
          text: 'Not found.'
        });
      }
      // Should we keep the file in memory or leave like that?
      fs.readFile(path.resolve(views, "choose_password"), 'utf-8', (err, data) => {
        if (err) {
          return reject(err);
        }
        data = data.replace("PARSE_SERVER_URL", `'${config.publicServerURL}'`);
        resolve({
          text: data
        })
      });
    });
  }

  requestResetPassword(req) {

    const config = req.config;

    if (!config.publicServerURL) {
      return this.missingPublicServerURL();
    }

    const { username, token: rawToken } = req.query;
    const token = rawToken && typeof rawToken !== 'string' ? rawToken.toString() : rawToken;

    if (!username || !token) {
      return this.invalidLink(req);
    }

    return config.userController.checkResetTokenValidity(username, token).then(() => {
      const params = qs.stringify({token, id: config.applicationId, username, app: config.appName, });
      return Promise.resolve({
        status: 302,
        location: `${config.choosePasswordURL}?${params}`
      })
    }, () => {
      return this.invalidLink(req);
    })
  }

  resetPassword(req) {

    const config = req.config;

    if (!config.publicServerURL) {
      return this.missingPublicServerURL();
    }

    const { username, new_password, token: rawToken } = req.body;
    const token = rawToken && typeof rawToken !== 'string' ? rawToken.toString() : rawToken;

    if (!username || !token || !new_password) {
      return this.invalidLink(req);
    }

    return config.userController.updatePassword(username, token, new_password).then(() => {
      const params = qs.stringify({username: username});
      return Promise.resolve({
        status: 302,
        location: `${config.passwordResetSuccessURL}?${params}`
      });
    }, (err) => {
      const params = qs.stringify({username: username, token: token, id: config.applicationId, error:err, app:config.appName})
      return Promise.resolve({
        status: 302,
        location: `${config.choosePasswordURL}?${params}`
      });
    });

  }

  invalidLink(req) {
    return Promise.resolve({
      status: 302,
      location: req.config.invalidLinkURL
    });
  }

  missingPublicServerURL() {
    return Promise.resolve({
      text:  'Not found.',
      status: 404
    });
  }

  setConfig(req) {
    req.config = new Config(req.params.appId);
    return Promise.resolve();
  }

  mountRoutes() {
    this.route('GET','/apps/:appId/verify_email',
      req => { this.setConfig(req) },
      req => { return this.verifyEmail(req); });

    this.route('GET','/apps/choose_password',
      req => { return this.changePassword(req); });

    this.route('POST','/apps/:appId/request_password_reset',
      req => { this.setConfig(req) },
      req => { return this.resetPassword(req); });

    this.route('GET','/apps/:appId/request_password_reset',
      req => { this.setConfig(req) },
      req => { return this.requestResetPassword(req); });
  }

  expressRouter() {
    const router = express.Router();
    router.use("/apps", express.static(public_html));
    router.use("/", super.expressRouter());
    return router;
  }
}

export default PublicAPIRouter;
