package com.example.sns.controller;

import static org.assertj.core.api.Assertions.assertThat;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

import java.io.IOException;
import java.nio.charset.StandardCharsets;
import java.util.ArrayList;
import java.util.List;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.web.servlet.AutoConfigureMockMvc;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.core.io.Resource;
import org.springframework.core.io.support.PathMatchingResourcePatternResolver;
import org.springframework.test.web.servlet.MockMvc;

/**
 * 화면 head 테스트.
 *
 * head를 화면마다 복사해 두었을 때 viewport가 11곳 모두 빠져 있어서, 휴대폰에서는 좁은 화면 규칙이 하나도 켜지지 않았다.
 * 그래서 head는 fragments/head.html 한 곳에만 두고, 새 화면이 그 조각을 빠뜨리면 여기서 걸리게 한다.
 */
@SpringBootTest
@AutoConfigureMockMvc
class PageHeadTest {

    private static final String SHARED_HEAD = "~{fragments/head :: head}";
    private static final String VIEWPORT = "<meta name=\"viewport\" content=\"width=device-width, initial-scale=1\">";

    @Autowired
    private MockMvc mockMvc;

    @Test
    @DisplayName("화면 템플릿은 모두 공용 head 조각을 쓰고 자기 head를 따로 적지 않는다")
    void everyPageUsesSharedHead() throws IOException {
        // fragments 아래는 화면 조각이라 head가 없다. templates 바로 아래 파일이 화면 하나씩이다.
        Resource[] pages = new PathMatchingResourcePatternResolver().getResources("classpath:templates/*.html");
        assertThat(pages).isNotEmpty();

        List<String> missing = new ArrayList<>();
        for (Resource page : pages) {
            String html = page.getContentAsString(StandardCharsets.UTF_8);
            if (!html.contains(SHARED_HEAD) || html.contains("<meta charset")) {
                missing.add(page.getFilename());
            }
        }
        assertThat(missing).as("공용 head 조각을 쓰지 않는 화면").isEmpty();
    }

    @Test
    @DisplayName("그려진 화면에 viewport가 있어 휴대폰에서 좁은 화면 규칙이 켜진다")
    void renderedPageHasViewport() throws Exception {
        for (String path : List.of("/login", "/signup")) {
            String html = mockMvc.perform(get(path))
                    .andExpect(status().isOk())
                    .andReturn().getResponse().getContentAsString(StandardCharsets.UTF_8);

            assertThat(html).as(path).contains(VIEWPORT);
            assertThat(html).as(path).containsOnlyOnce("<meta charset");
        }
    }
}
