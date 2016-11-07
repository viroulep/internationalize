import angular from 'angular';

import showRawDialogTemplate from './dialogs/show-raw.template';
import ShowRawDialogController from './dialogs/show-raw.controller';

import synchronizeDialogTemplate from './dialogs/synchronize.template';
import SynchronizeDialogController from './dialogs/synchronize.controller';

export default class TranslationsShowController {
  constructor(translation, $state, TranslationUtils, $mdDialog) {
    'ngInject';

    this.translation = translation;
    this.$state = $state;
    this.TranslationUtils = TranslationUtils;
    this.$mdDialog = $mdDialog;

    this.currentState = $state.current.name;
    this.navItems = [{
      state: 'translations.show.translate',
      text: 'Translate'
    }, {
      state: 'translations.show.browse',
      text: 'Browse'
    }];
  }

    showRaw(event) {
      let yamlData = this.TranslationUtils.processedDataToYaml(this.translation.data);
      this.$mdDialog.show({
        tergetEvent: event,
        clickOutsideToClose: true,
        parent: angular.element('body'),
        template: showRawDialogTemplate,
        controllerAs: 'dialog',
        controller: ShowRawDialogController,
        locals: { yamlData }
      });
    }

    download() {
      let yamlData = this.TranslationUtils.processedDataToYaml(this.translation.data);
      let blob = new Blob([yamlData], { type: 'text/yaml' });
      let downloadLink = angular.element('<a></a>')
                        .attr('href', window.URL.createObjectURL(blob))
                        .attr('download', `${this.translation.locale}.yml`);
      angular.element('body').append(downloadLink);
      downloadLink[0].click().remove();
    }

    synchronizeWithRemote(event) {
      this.TranslationUtils.pullRemoteData(this.translation.sourceUrl, this.translation.data)
        .then(({ newData, newUntranslatedKeysCount, unusedTranslatedKeysCount }) => {
          this.$mdDialog.show({
            tergetEvent: event,
            clickOutsideToClose: true,
            parent: angular.element('body'),
            template: synchronizeDialogTemplate,
            controllerAs: 'dialog',
            controller: SynchronizeDialogController,
            locals: { translation: this.translation, newData, newUntranslatedKeysCount, unusedTranslatedKeysCount }
          });
        });
    }
}